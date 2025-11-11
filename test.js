function replaceSqlParamsWithRequest(query, request) {
    return query.replace(/@(\w+)/g, (match, paramName) => {
        // 查找 request 中是否有該變數，並返回對應的值
        if (request.hasOwnProperty(paramName)) {
            return request[paramName];
        }
        return match; // 若 request 中未找到對應的變數，則返回原本的 @變數
    });
}
const request = {
    chestId: 123,
    userId: 456,
    gameId: 789,
    latitude: 25.0478,
    longitude: 121.5319,
    userAnswer: "A"
};

const query = `
    SELECT * 
    FROM EventChestHistory 
    WHERE src_id = @chestId AND game_id_id = @gameId
`;
console.log(replaceSqlParamsWithRequest(query, request))