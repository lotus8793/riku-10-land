// りくのぼうけん・かけざんジムAの状態遷移。
const KakezanVisual = (() => {
const initialGame = { problem: { each: 2, groups: 3 }, answer: [], total: '', phase: 'each', number: 1, solved: 0 };
function enterDigit(game, value, { requireTotalInput = false } = {}) {
    if (!Number.isInteger(value) || value < 0 || value > 9)
        return game;
    if (game.phase === 'total') {
        if (game.total.length >= 2 || (!game.total && value === 0))
            return game;
        return { ...game, total: game.total + value };
    }
    if (value === 0)
        return game;
    if (game.phase === 'each')
        return { ...game, answer: [value], phase: 'groups' };
    if (game.phase !== 'groups')
        return game;
    const answer = [game.answer[0], value];
    const right = answer[0] === game.problem.each && value === game.problem.groups;
    if (right && !requireTotalInput) {
        return { ...game, answer, total: String(game.problem.each * game.problem.groups), phase: 'done', solved: game.solved + 1 };
    }
    return { ...game, answer, phase: right ? 'total' : 'factor-error' };
}
function submitTotal(game) {
    if (game.phase !== 'total' || !game.total)
        return game;
    const correct = Number(game.total) === game.problem.each * game.problem.groups;
    return { ...game, phase: correct ? 'done' : 'total-error', solved: game.solved + (correct ? 1 : 0) };
}
function undoDigit(game) {
    if (game.phase === 'total' && game.total)
        return { ...game, total: game.total.slice(0, -1) };
    if (game.phase === 'total')
        return { ...game, answer: game.answer.slice(0, 1), phase: 'groups' };
    if (game.phase === 'groups')
        return { ...game, answer: [], phase: 'each' };
    return game;
}
function retryGame(game) {
    if (game.phase === 'total-error')
        return { ...game, total: '', phase: 'total' };
    if (game.phase === 'factor-error')
        return { ...game, answer: [], total: '', phase: 'each' };
    return game;
}
function nextGame(game, random = Math.random()) {
    if (game.phase !== 'done')
        return game;
    const offset = 1 + Math.floor(Math.min(Math.max(random, 0), 0.999999999) * 80);
    const index = ((game.problem.each - 1) * 9 + game.problem.groups - 1 + offset) % 81;
    return { ...game, problem: { each: Math.floor(index / 9) + 1, groups: index % 9 + 1 }, answer: [], total: '', phase: 'each', number: game.number + 1 };
}

return { initialGame, enterDigit, submitTotal, undoDigit, retryGame, nextGame };
})();
