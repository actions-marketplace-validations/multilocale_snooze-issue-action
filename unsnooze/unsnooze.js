const { getInput, setFailed } = require('@actions/core')
const { context, getOctokit } = require('@actions/github')

module.exports = async function unsnooze() {
  try {
    const githubToken = getInput('githubToken')

    const octokit = getOctokit(githubToken)

    const { owner, repo } = context.repo

    console.log({ owner })
    console.log({ repo })

    const issues = await octokit.rest.issues
      .listForRepo({
        owner,
        repo,
        state: 'closed',
        labels: 'snoozed',
      })
      .then(({ data }) => data)
      .catch(error => {
        console.log(`error on octokit.rest.issues.listForRepo: ${error}`)
        throw error
      })

    // console.log({ issues })

    for (let i = 0; i < issues.length; i += 1) {
      const issue = issues[0]
      const comments = await octokit.rest.issues
        .listComments({
          owner,
          repo,
          issue_number: issue.number,
          per_page: 100,
          sort: 'created',
          direction: 'asc',
        })
        .then(({ data }) => data)
        .catch(error => {
          console.error(`error on octokit.rest.issues.listComments: ${error}`)
          throw error
        })

      const snoozeComment = comments.filter(({ body }) =>
        body.includes('<!-- snooze ='),
      )[0]

      if (snoozeComment) {
        try {
          const snoozeString = snoozeComment.body
            .substring(
              snoozeComment.body.lastIndexOf('<!-- snooze =') +
                '<!-- snooze ='.length,
              snoozeComment.body.lastIndexOf('-->'),
            )
            .trim()

          console.log({ snoozeString })

          const snoozeData = JSON.parse(snoozeString)
          let { reopenDate } = snoozeData

          reopenDate = new Date(reopenDate)

          if (Date.now() > reopenDate.getTime()) {
            const labels = issue.labels.filter(label => label !== 'snoozed')

            await octokit.rest.issues.update({
              owner,
              repo,
              issue_number: issue.number,
              state: 'open',
              labels,
            })
          }
        } catch (error) {
          console.error(`error while parsing snooze data in comment ${error}`)
          throw error
        }
      }
    }
  } catch (error) {
    console.error(error)
    core.setFailed(error.message)
  }
}
