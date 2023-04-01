document.getElementById("message-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();
  if (message) {
    const timestamp = new Date();
    displayMessage(message, "user", timestamp);
    sendToChatGPT(message).then((responseMessage) => {
      displayMessage(responseMessage, "assistant", timestamp);
      saveConversationHistory(message, responseMessage, timestamp);
    });
  }
  messageInput.value = "";
});

function displayMessage(message, sender, timestamp) {
  const messagesDiv = document.getElementById("messages");
  const messageElement = document.createElement("div");
  messageElement.className = sender;

  // Create the message content element
  const messageContent = document.createElement("span");
  messageContent.className = "message-content";
  messageContent.textContent = message;
  messageElement.appendChild(messageContent);

  // Create the timestamp element
  const timestampElement = document.createElement("span");
  timestampElement.className = "timestamp";
  timestampElement.textContent = formatTimestamp(timestamp);
  messageElement.appendChild(timestampElement);

  // Add the message element to the messages container
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendToChatGPT(message) {
  const apiKey = window.config.API_KEY;
  const apiUrl = "https://api.openai.com/v1/chat/completions";
  let conversation = JSON.parse(localStorage.getItem("conversation")) || [];
  const messages = [{ role: "system", content: window.config.INITIAL_SYSTEM_PROMPT }];

  conversation.forEach((history) => {
    if (history.userMessage) messages.push({ role: "user", content: history.userMessage });
    if (history.assistantMessage) messages.push({ role: "assistant", content: history.assistantMessage });
  });
  messages.push({ role: "user", content: getLocalDateTimeString() + " " + message });

  let retryCount = 0;
  const maxRetries = 10;

  while (retryCount < maxRetries) {
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 512,
    };

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Check if the error is related to token limit
        if (response.status === 400 && errorData.error && errorData.error.code === "context_length_exceeded") {
          // Remove the oldest user and assistant message pair
          messages.splice(1, 2);
          retryCount++;

          // Update the conversation history in localStorage
          conversation.shift();
          localStorage.setItem("conversation", JSON.stringify(conversation));

          continue;
        }

        throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const generatedMessage = data.choices[0].message.content.trim();
      return generatedMessage;
    } catch (error) {
      console.error("Error:", error.message);
      alert("Error: " + error.message);
      return null;
    }
  }

  alert("Failed to generate a response after several retries. Please try again.");
  return null;
}

function getFormattedDate(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (inputDate.valueOf() === today.valueOf()) {
    return "Today";
  } else if (inputDate.valueOf() === yesterday.valueOf()) {
    return "Yesterday";
  } else {
    const day = String(inputDate.getDate()).padStart(2, "0");
    const month = String(inputDate.getMonth() + 1).padStart(2, "0");
    const year = inputDate.getFullYear();
    return `${day}-${month}-${year}`;
  }
}

function getLocalDateTimeString() {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();
  return `${date} ${time}`;
}

function formatTimestamp(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const formattedDate = getFormattedDate(date);
  return `${formattedDate} ${hours}:${minutes}`;
}

function saveConversationHistory(userMessage, assistantMessage, timestamp) {
  const history = {
    userMessage,
    assistantMessage,
    timestamp,
  };
  let conversation = JSON.parse(localStorage.getItem("conversation")) || [];
  conversation.push(history);
  localStorage.setItem("conversation", JSON.stringify(conversation));
}

function loadConversationHistory() {
  const conversation = JSON.parse(localStorage.getItem("conversation")) || [];
  conversation.forEach((history) => {
    displayMessage(history.userMessage, "user", new Date(history.timestamp));
    displayMessage(history.assistantMessage, "assistant", new Date(history.timestamp));
  });
}

document.addEventListener("DOMContentLoaded", loadConversationHistory);
