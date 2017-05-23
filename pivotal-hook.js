exports.pivotalHook = function (event, context, callback) {
  console.log(event);
  callback(null, 'Elo')
};