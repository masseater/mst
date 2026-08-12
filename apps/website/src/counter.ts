const COUNT_ATTRIBUTE = "data-count";

export const setupCounter = (button: HTMLButtonElement): void => {
  const showCount = (count: number): void => {
    button.setAttribute(COUNT_ATTRIBUTE, String(count));
    button.replaceChildren(`Count is ${count}`);
  };
  button.addEventListener("click", () => {
    showCount(Number(button.getAttribute(COUNT_ATTRIBUTE)) + 1);
  });
  showCount(0);
};
