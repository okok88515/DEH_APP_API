function debugPrint(query, request) {
    // 移除每一行開頭的空白
    query = query.replace(/^\s+/gm, '');  // 這裡的 g 表示全局替換，m 表示多行處理

    const injectedQuery = query.replace(/@(\w+)/g, (match, paramName) => {
        // 查找 request 中是否有該變數，並返回對應的值
        if (request.hasOwnProperty(paramName)) {
            let value = request[paramName];
            if (typeof value === 'string' && /^\d+(\,\d+)*$/.test(value)) {
                // 如果是數字字串或包含逗號的數字字串，則不加單引號
                return value;
            } else if (typeof value === 'string')
                return `\'${value}\'`; // 如果是字串，則加上單引號
            else return value; // 否則直接返回該值
        }
        return null; // 若 request 中未找到對應的變數，則返回原本的 @變數
    });

    console.log("do query: ", injectedQuery); // 輸出處理過的查詢語句
}
function getCount(number, defaultCount = 50, minCount = 10, maxCount = 100) {
    return !isNaN(Number(number)) ? Math.min(Math.max(Number(number), minCount), maxCount) : defaultCount;
}
function joinIfAllInt(list) {
    if (list.every(it => Number.isInteger(it))) {
        const idListString = list.join(',');
        return idListString === '' ? '-1' : idListString;
    }
    return '0'
}


module.exports = { debugPrint, getCount, joinIfAllInt }