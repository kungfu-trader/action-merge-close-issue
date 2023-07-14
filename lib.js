const { Octokit } = require('@octokit/rest');
const axios = require('axios');

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
    console.log(`close issue completed ${issue_number}`);
  } catch (e) {
    console.log(e.message);
  }
};

const closeIssue = async function (argv, pullRequestNumber, close) {
  const octokit = new Octokit({
    auth: argv.token,
  });
  const iss = await octokit.graphql(`
    query{
      repository(name: "${argv.repo}", owner: "kungfu-trader") {
        pullRequest(number: ${pullRequestNumber}) {
          closingIssuesReferences (first: 100) {
            edges {
              node {
                number
                body
                title
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
      const body = issue.node.body;
      const title = issue.node.title;

      const lastIdx = title.indexOf('#', 1);
      const itemId = title.slice(1, lastIdx);

      if (close) {
        console.log('close issue', `prNumber: ${prNumber} body: ${body}, title: ${title} repo: ${argv.repo}`);
        await doCloseIssue(argv.token, argv.repo, prNumber);
        if (lastIdx > 1) {
          console.log(`updateStatus to monday boardId: ${body} itemId: ${itemId} targetStatus: Done`);
          await updateStatus(argv.mondayApi, body, itemId, 'Done');
        }
      } else {
        if (lastIdx > 1) {
          console.log(`updateStatus to monday boardId: ${body} itemId: ${itemId} targetStatus: Waiting test`);
          await updateStatus(argv.mondayApi, body, itemId, 'Waiting test');
        }
      }
    }
  }
};

getMatchName = function (headIn, baseIn) {
  const failObj = { match: false, close: false, head: '', base: '' };
  const match = headIn.match(/(dev|alpha)\/v(\d+)\/v(\d+\.\d)/);
  if (!match) {
    return failObj;
  }
  const channel = match[1];

  let baseChannel = 'alpha';
  if (channel == 'alpha') {
    baseChannel = 'release';
  }
  const bashValidate = headIn.replace(channel, baseChannel);
  if (bashValidate != baseIn) {
    return failObj;
  }
  const closeObj = { match: true, close: false, head: '', base: '' };
  if (channel == 'dev') {
    return closeObj;
  } else {
    return { match: true, close: true, head: headIn.replace('alpha', 'dev'), base: headIn };
  }
};

exports.getPulls = async function (argv, prNumber) {
  const octokit = new Octokit({
    auth: argv.token,
  });
  try {
    let hasNextPage = true;
    let page = 1;
    let head = '';
    let base = '';
    let matchName;
    do {
      const pulls = await octokit.request(`GET /repos/kungfu-trader/${argv.repo}/pulls`, {
        owner: 'kungfu-trader',
        repo: argv.repo,
        state: 'all',
        per_page: 1,
        page: page,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (pulls.data.length < 1) {
        hasNextPage = false;
        break;
      } else {
        page++;
        console.log('pr number', pulls.data[0].number, prNumber);
        if (head && base) {
          curHead = pulls.data[0].head.ref;
          curBase = pulls.data[0].base.ref;
          if (head == curHead && base == curBase) {
            break;
          } else if (curHead == matchName.head && curBase == matchName.base) {
            await closeIssue(argv, pulls.data[0].number, true);
          }
        } else if (!head && !base && pulls.data[0].number == prNumber) {
          head = pulls.data[0].head.ref;
          base = pulls.data[0].base.ref;
          matchName = getMatchName(head, base);
          console.log('head', head, 'base', base);
          console.log('matchName', JSON.stringify(matchName));
          if (!matchName.match) {
            break;
          } else if (!matchName.close) {
            await closeIssue(argv, pulls.data[0].number, false);
            break;
          } else {
            await closeIssue(argv, pulls.data[0].number, true);
          }
        }
      }
    } while (hasNextPage);
  } catch (e) {
    console.error(e);
  }
};

updateStatus = async function (mondayapi, boardId, itemId, status) {
  if (!boardId || boardId.length < 5) {
    console.log('empty boardId:', boardId);
    return;
  }
  if (!itemId || itemId.length < 5) {
    console.log('empty itemId:', itemId);
    return;
  }
  let query3 = `mutation{ change_column_value (board_id:${boardId}, item_id:${itemId}, column_id: "status", value: "{\\\"label\\\": \\\"${status}\\\"}"){id}}`;
  // move_item_to_group (item_id: ${itemId}, group_id: ${groupId}) {
  //     id
  // }
  try {
    const ret = await axios.post(
      'https://api.monday.com/v2',
      JSON.stringify({
        query: query3,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: mondayapi,
        },
      },
    );
    console.log(`updateStatus to monday completed boardId: ${boardId} itemId: ${itemId}`);
  } catch (e) {
    console.log('-------------------');
    // throw new Error(`updateStatus to monday failed ${e.message}`);
    console.error(`updateStatus to monday failed ${e.message} boardId: ${boardId} itemId: ${itemId}`);
  }
};
