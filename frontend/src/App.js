import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState(null);
  const [reviewedMessages, setReviewedMessages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the oldest message awaiting review
    fetchOldestMessage();
    fetchReviewedMessages(currentPage); // Fetch the initial page of reviewed messages
  }, [currentPage]); // Re-fetch when currentPage chang

  const fetchOldestMessage = async () => {
    setLoading(true);

    const response = await fetch(
      "https://human-in-the-loop.groff.workers.dev/get-oldest-message"
    );
    if (response.ok) {
      const data = await response.json();
      setMessage(data);
    } else {
      console.error("Failed to fetch the oldest message");
    }

    setLoading(false);
  };

  const fetchReviewedMessages = async (page) => {
    const response = await fetch(
      `https://human-in-the-loop.groff.workers.dev/get-reviewed-messages?page=${page}`
    );
    if (response.ok) {
      const data = await response.json();
      setReviewedMessages(data);
    } else {
      console.error("Failed to fetch reviewed messages");
    }
  };

  // Handler for approving a message
  const approveMessage = async () => {
    if (!message) return;

    const response = await fetch(
      `https://human-in-the-loop.groff.workers.dev/update-message-status/${message.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      }
    );

    if (response.ok) {
      setMessage(null); // Clear the current message or fetch the next one

      setReviewedMessages((prevMessages) => [
        { ...message, approvalStatus: "approved", updated_at: new Date() },
        ...prevMessages,
      ]);
    } else {
      console.error("Failed to approve the message");
    }
  };

  // Handler for denying a message
  const denyMessage = async () => {
    if (!message) return;

    const response = await fetch(
      `https://human-in-the-loop.groff.workers.dev/update-message-status/${message.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "denied" }),
      }
    );

    if (response.ok) {
      setMessage(null); // Clear the current message or fetch the next one

      setReviewedMessages((prevMessages) => [
        { ...message, approvalStatus: "denied", updated_at: new Date()},
        ...prevMessages,
      ]);
    } else {
      console.error("Failed to deny the message");
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="App">
      <div className="App-content">
        <div className="App-header">
          {message ? (
            <>
              <p>Message for Review:</p>
              <div>{message.content}</div>
              <button
                className="button button-approve"
                onClick={approveMessage}
              >
                Approve
              </button>
              <button className="button button-deny" onClick={denyMessage}>
                Deny
              </button>
            </>
          ) : (
            <>
              <p>No messages awaiting review</p>
              <button disabled={loading} onClick={() => fetchOldestMessage()}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </>
          )}
        </div>
        <div className="ReviewedMessages">
          <h2>Previously Reviewed Messages</h2>
          <table>
            <thead>
              <tr>
                <th>Content</th>
                <th>Status</th>
                <th>Reviewed At</th>
              </tr>
            </thead>
            <tbody>
              {reviewedMessages.map((msg) => (
                <tr key={msg.id}>
                  <td>{msg.content}</td>
                  <td
                    className={
                      msg.approvalStatus === "approved"
                        ? "status-approved"
                        : "status-denied"
                    }
                  >
                    {msg.approvalStatus}
                  </td>{" "}
                  <td>{new Date(msg.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <button onClick={() => handlePageChange(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
