// language table
exports.tableExists = function(clang) {
  if (clang === undefined) { // default
    return '中文';
  } else {
    switch (clang) {
    case "en":
      return '英文';
    case "tw":
      return '中文';
    case "jp":
      return '日文';
    default:
      return undefined;
    }
  }
}
