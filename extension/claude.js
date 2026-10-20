MailReviewTransfer.start({
  name: "Claude",
  newPaths: ["/new", "/new/"],
  submittedPrefix: "/chat/",
  editorSelector: '[data-testid="chat-input"][contenteditable="true"], [contenteditable="true"][role="textbox"]',
  sendSelector: '[data-testid="chat-input-send"]',
  maxImageDimension: 8000
});
