const bluebird = require('bluebird')
const tracker = require('pivotaltracker')
const github = require('github')

const TITLE_PATTERN = /#(\d+)/

const githubClient = new github()
githubClient.authenticate({
  type: 'token',
  token: process.env.GITHUB_ACCESS_TOKEN
})

const trackerClient = new tracker.Client(process.env.PIVOTAL_ACCESS_TOKEN)

function getPivotalStatus (projectId, storyNumber) {
  return new Promise((resolve, reject) =>
    trackerClient
      .project(projectId)
      .story(storyNumber)
      .get((error, story) => {
          if (error) reject(error)

          const storyAccepted = story.currentState === 'accepted'
          const state = storyAccepted ? 'success' : 'failure'
          const target_url = story.url
          const description = `Story was ${storyAccepted ? '' : 'not '}accepted`
          const context = 'continuous-integration/pivotal'

          resolve({state, target_url, description, context})
        }
      ))
}

function createStatus (repo, owner, sha, projectId, storyNumber) {
  console.log(repo, owner, sha, projectId, storyNumber)
  return getPivotalStatus(projectId, storyNumber)
    .then(params =>
      githubClient.repos.createStatus(Object.assign({repo, owner, sha}, params))
    )
}

exports.handler = function (event, context, callback) {
  body = event.body
  console.log(event.params)
  console.log(event.headers)
  console.log(body)

  const eventType = event.headers['X-GitHub-Event']

  console.log('Beatka')
  console.log(eventType)

  const repo = body.repository.name
  const projectId = event.params.project_id

  if (eventType === 'pull_request') {
    const prTitle = body.pull_request.title
    const owner = body.pull_request.head.repo.owner.login
    const sha = body.pull_request.head.sha
    const storyNumber = prTitle.match(TITLE_PATTERN)[1]

    console.log(prTitle, owner, sha, storyNumber)

    createStatus(repo, owner, sha, projectId, storyNumber)
      .then(res => {
        console.log(res)
        callback(null, {statusCode: 200})
      })

  } else if (eventType === 'push') {
    const owner = body.repository.owner.name
    const sha = body.head_commit.id

    console.log(repo, owner, sha)

    githubClient.pullRequests
      .getAll({repo, owner, head: sha})
      .then(({data: prs}) => prs[0])
      .then(pr => pr.title.match(TITLE_PATTERN)[1])
      .then(storyNumber => createStatus(repo, owner, sha, projectId, storyNumber))
      .then(res => {
        console.log(res)
        callback(null, {statusCode: 200})
      })
  }

}