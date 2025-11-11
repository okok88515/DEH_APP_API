// identifier class table
exports.tableExists = function(iClass) {
  if (iClass === undefined) {
    return null;
  } else {
    switch(iClass) {
      case "player":
        console.log("player poi request...");
        return 'user';
        break;
      case "expert":
        console.log("expert poi request...");
        return 'expert';
        break;
      case "docent":
        console.log("docent poi request...");
        return 'docent';
        break;
      default:
        return undefined;
    }
  }
}
