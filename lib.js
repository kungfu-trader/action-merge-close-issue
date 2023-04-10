const { Octokit } = require('@octokit/rest');

const doCloseIssue = async function (token, repo, issue_number) {
  const octokit = new Octokit({
    auth: token,
  });
  try {
    await octokit.request(`PATCH /repos/kungfu-trader/${repo}/issues/${issue_number}`, {
      owner: 'kungfu-trader',
      repo: repo,
      issue_number: issue_number,
      state: 'closed',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    console.log(`close issue ${issue_number} for repo ${repo}`);
  } catch (e) {
    console.log(e);
  }
};

exports.closeIssue = async function (argv) {
  const octokit = new Octokit({
    auth: argv.token,
  });
  const iss = await octokit.graphql(`
    query{
      repository(name: "${argv.repo}", owner: "kungfu-trader") {
        pullRequest(number: ${argv.pullRequestNumber}) {
          closingIssuesReferences (first: 100) {
            edges {
              node {
                number
              }
            }
          }
        }
      }
    } 
  `);
  const issNumbers = iss?.repository?.pullRequest?.closingIssuesReferences.edges;
  if (issNumbers) {
    for (const issue of issNumbers) {
      const prNumber = issue.node.number;
      console.log('To close issue', prNumber);
      await doCloseIssue(argv.token, argv.repo, prNumber);
    }
  }
};
