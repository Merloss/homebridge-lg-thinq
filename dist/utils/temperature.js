export function fToC(fahrenheit) {
    return parseFloat(((fahrenheit - 32) * 5 / 9).toFixed(1));
}
export function cToF(celsius) {
    return Math.round(celsius * 9 / 5 + 32);
}
//# sourceMappingURL=temperature.js.map