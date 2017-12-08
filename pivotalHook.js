const bluebird = require('bluebird')
const github = require('github')

const githubClient = new github()
githubClient.authenticate({
  type: 'token',
  token: process.env.GITHUB_ACCESS_TOKEN
})

exports.handler = function (event, context, callback) {
  body = event.body
  params = event.params
  console.log(event.params)
  console.log(body)

  const owner = params.owner
  const repo = params.repo
  const projectUrl = body.primary_resources[0].url
  const resourceKind = body.primary_resources[0].kind
  const storyId = body.primary_resources[0].id

  if (resourceKind === 'story') {
    const changes = body.changes.find(change => change.kind === 'story')
    const acceptedAt = changes.new_values.accepted_at
    const state = acceptedAt ? 'success' : 'failure'
    const target_url = projectUrl
    const description = `Story was ${acceptedAt ? '' : 'not '}accepted`
    const context = 'continuous-integration/pivotal'

    console.log(changes, acceptedAt, state, target_url, description)

    githubClient.pullRequests
      .getAll({repo, owner})
      .then(({data: prs}) => prs.find(pr => pr.title.match(`#${storyId}`)))
      .then(pr => githubClient.pullRequests.getCommits({owner, repo, number: pr.number, per_page: 100}))
      .then(({data: commits}) => commits[commits.length - 1].sha)
      .then(sha => githubClient.repos.createStatus({repo, owner, sha, state, target_url, description, context}))
      .then(res => {
        console.log(res)
        callback(null, {statusCode: 200})
      })
      .catch(error => {
        console.log(error)
        callback(null, {statusCode: 404})
      })
  }
}