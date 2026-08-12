export const setupCounter = (button: HTMLButtonElement): void => {
  let clickCount = 0;
  const renderCount = (renderedCount: number): void => {
    clickCount = renderedCount;
    button.textContent = `Count is ${clickCount}`;
  };
  button.addEventListener("click", () => {
    renderCount(clickCount + 1);
  });
  renderCount(0);
};
