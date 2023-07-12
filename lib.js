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
    console.log(`close issue ${issue_number} for repo ${repo}`);
  } catch (e) {
    console.log(e);
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
      console.log('To close issue', prNumber, body, title, close);

      if (close) {
        console.log('doCloseIssue issuenumber', prNumber);
        await doCloseIssue(argv.token, argv.repo, prNumber);
        const lastIdx = title.indexOf('#', 1);
        if (lastIdx > 1) {
          const itemId = title.slice(1, lastIdx);
          console.log('updateStatus', body, itemId);
          await updateStatus(argv.mondayApi, body, itemId, 'Done');
        }
      } else {
        const lastIdx = title.indexOf('#', 1);
        if (lastIdx > 1) {
          const itemId = title.slice(1, lastIdx);
          console.log('updateStatus', body, itemId);
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

// const getMondayInfo = async ({mondayApi, board_id, item_id}) => {
//   const query = `
//   query{
//       boards(ids:${board_id}){
//         groups {
//           title
//           id
//         }
//         items(ids:${item_id}){
//           id
//           name
//           group {
//               id
//               title
//           }
//           state
//         }
//         name
//         id
//       }
//     }
//   `;
//   const result = await axios.post(
//       'https://api.monday.com/v2',
//       JSON.stringify({query,}),
//       {
//           headers: {
//               'Content-Type': 'application/json',
//               Authorization: mondayApi,
//           }
//       });
//       if (!Array.isArray(result?.data?.data?.boards)) {
//           return;
//       }
//       return {
//           items: result.data.data.boards.reduce((acc, cur) => {
//               const devGroupId = cur.groups.find(v => 'In development' === v.title).id;
//               return [...acc, ...cur.items
//                   .filter(v => v.group.id === devGroupId)
//                   .map(v => ({
//                       ...v,
//                       board_id: cur.id,
//                       board_name: cur.name
//                   }))]
//       }, [])
//     }
// }

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
    console.log(ret);
  } catch (e) {
    console.log('-------------------');
    console.log(e);
  }
};
