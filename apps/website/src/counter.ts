const COUNT_ATTRIBUTE = "data-count";

export const setupCounter = (button: HTMLButtonElement): void => {
  const renderCount = (renderedCount: number): void => {
    button.setAttribute(COUNT_ATTRIBUTE, String(renderedCount));
    button.replaceChildren(`Count is ${renderedCount}`);
  };
  button.addEventListener("click", () => {
    renderCount(Number(button.getAttribute(COUNT_ATTRIBUTE)) + 1);
  });
  renderCount(0);
};
