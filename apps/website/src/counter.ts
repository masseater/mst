const COUNT_ATTRIBUTE = "data-count";

export const setupCounter = (button: HTMLButtonElement): void => {
  const showCount = (shownCount: number): void => {
    button.setAttribute(COUNT_ATTRIBUTE, String(shownCount));
    button.replaceChildren(`Count is ${shownCount}`);
  };
  button.addEventListener("click", () => {
    showCount(Number(button.getAttribute(COUNT_ATTRIBUTE)) + 1);
  });
  showCount(0);
};
