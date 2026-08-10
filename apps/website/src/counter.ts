export const setupCounter = (button: HTMLButtonElement): void => {
  let clickCount = 0;
  const renderCount = (nextCount: number): void => {
    clickCount = nextCount;
    button.textContent = `Count is ${clickCount}`;
  };
  button.addEventListener("click", () => {
    renderCount(clickCount + 1);
  });
  renderCount(0);
};
