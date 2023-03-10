/* eslint-disable no-restricted-globals */
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
  const maxPerPage = 100;
  const octokit = new Octokit({
    auth: argv.token,
  });
  const commits = await octokit.request(
    `GET /repos/kungfu-trader/${argv.repo}/issues/${argv.pullRequestNumber}/comments`,
    {
      per_page: maxPerPage,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  const re = /#\d+/g;
  for (const element of commits.data) {
    const issues = element.body.match(re);
    if (issues) {
      console.log('issues', issues);
      for (const it of issues) {
        await doCloseIssue(argv.token, argv.repo, it.substring(1));
      }
    }
  }
};
