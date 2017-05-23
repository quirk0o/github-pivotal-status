const bluebird = require('bluebird')
const tracker = require('pivotaltracker')
const github = require('github')

/*
 repo = payload['repository']['full_name']

 if event_type == 'pull_request' || event_type == 'push'
 if event_type == 'pull_request'
 pull_request = payload['pull_request']
 pull_request_title = pull_request['title']
 sha = pull_request['head']['sha']
 elsif event_type == 'push'
 sha = payload['head_commit']['id']
 pull_request = github_client.pull_requests(repo, head: sha)[0]
 pull_request_title = pull_request.title
 end

 story_id = pull_request_title.match(/(?<=#)\d+(?=\s)/).to_s

 project = pivotal_client.project(params['pivotal_project_id'])
 story = project.story(story_id)
 story_accepted = story.current_state == 'accepted'
 state = story_accepted ? 'success' : 'failure'

 options = {
 target_url: story.url,
 description: "Story was #{story_accepted ? '' : 'not'} accepted",
 context: 'continuous-integration/pivotal'
 }
 github_client.create_status(repo, sha, state, options)
 */

const TITLE_PATTERN = /#(\d+)(?=\s)/

exports.githubHook = function (event, context, callback) {
  console.log(event)

  const githubClient = new github()
  githubClient.authenticate({
    type: 'token',
    token: process.env.GITHUB_ACCESS_TOKEN
  })

  const trackerClient = new tracker.Client(process.env.PIVOTAL_ACCESS_TOKEN)

  const repo = event.repository.name
  const owner = event.repository.owner.name
  const sha = event.head_commit.id

  console.log(repo, owner, sha)

  githubClient.pullRequests
    .getAll({repo, owner, head: sha})
    .then(({data: prs}) => prs[0])
    .then(pr => pr.title.match(TITLE_PATTERN)[1])
    .then(storyNumber => {
      trackerClient
        .project(event.params.project_id)
        .story(storyNumber)
        .get((error, story) => {
          console.log(error, story)
          const storyAccepted = story.currentState === 'accepted'
          const state = storyAccepted ? 'success' : 'failure'
          const target_url = story.url
          const description = `Story was ${storyAccepted ? '' : 'not '}accepted`
          const context = 'continuous-integration/pivotal'

          console.log({repo, sha, state, target_url, description, context})

          return githubClient.repos.createStatus({repo, owner, sha, state, target_url, description, context})
            .then(res => {
              console.log(res)
              callback(null, {statusCode: 200})
            })
        })
    })
}