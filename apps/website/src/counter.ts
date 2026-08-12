const COUNT_ATTRIBUTE = "data-count";

export const setupCounter = (button: HTMLButtonElement): void => {
  const renderCount = (nextCount: number): void => {
    button.setAttribute(COUNT_ATTRIBUTE, String(nextCount));
    button.replaceChildren(`Count is ${nextCount}`);
  };
  button.addEventListener("click", () => {
    renderCount(Number(button.getAttribute(COUNT_ATTRIBUTE)) + 1);
  });
  renderCount(0);
};
