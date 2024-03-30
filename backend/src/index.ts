export interface Env {
  MY_QUEUE: Queue;
  MY_DB: D1Database;
}

interface MessageBody {
  message: string;
}

interface UpdateMessageBody {
  status: "approved" | "denied";
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const params = url.searchParams;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (req.method === "POST" && path === "/add-message") {
      let data: MessageBody;
      try {
        data = (await req.json()) as MessageBody;
      } catch (err) {
        return new Response("Invalid JSON body", {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      if (typeof data.message !== "string" || data.message.trim() === "") {
        return new Response("You must send a 'message' in the request body", {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      await env.MY_QUEUE.send(data.message);
      return new Response("Message sent to the queue", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    } else if (req.method === "GET" && path === "/get-oldest-message") {
      return getOldestMessageAwaitingReview(env);
    } else if (req.method === "GET" && path === "/get-reviewed-messages") {
      const page = parseInt(params.get("page") || "1", 10);
      return getReviewedMessages(env, page);
    } else if (
      req.method === "PUT" &&
      path.startsWith("/update-message-status/")
    ) {
      const messageId = path.split("/").pop();
      return updateMessageStatus(req, env, messageId);
    } else {
      return new Response("Endpoint not found or method not supported", {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
  },
  async queue(batch: MessageBatch<Error>, env: Env): Promise<void> {
    // A queue consumer can make requests to other endpoints on the Internet,
    // write to R2 object storage, query a D1 Database, and much more.
    for (let message of batch.messages) {
      // Process each message
      console.log(
        `message ${message.id} processed: ${JSON.stringify(message.body)}`
      );

      console.log("messageBody", message.body);

      // Inserting a message into D1
      await insertMessage(
        {
          id: message.id,
          content: `${message.body}`,
        },
        env
      );
    }
  },
};

async function getReviewedMessages(env: Env, page: number): Promise<Response> {
  const limit = 10;
  const offset = (page - 1) * limit;
  const queryResult = await env.MY_DB.prepare(
    `SELECT * FROM messages WHERE approvalStatus IN ('approved', 'denied') ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();
  return new Response(JSON.stringify(queryResult.results), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Inserting a message into D1
async function insertMessage(
  message: { id: string; content: string },
  env: Env
): Promise<void> {
  try {
    const insertStatement = env.MY_DB.prepare(
      "INSERT INTO messages (id, content, approvalStatus) VALUES (?, ?, ?)"
    );

    // Bind the values and execute the insertion
    const response = await insertStatement
      .bind(message.id, message.content, "awaiting_review")
      .run();

    console.log(`Inserted message ${message.id}: ${response}`);
  } catch (e) {
    console.error(`Error inserting message ${message.id}: ${e}`);
  }
}

async function getOldestMessageAwaitingReview(env: Env): Promise<Response> {
  const queryResult = await env.MY_DB.prepare(
    "SELECT * FROM messages WHERE approvalStatus = 'awaiting_review' ORDER BY created_at ASC LIMIT 1"
  ).all();
  if (queryResult.results.length > 0) {
    return new Response(JSON.stringify(queryResult.results[0]), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } else {
    return new Response(
      JSON.stringify({ message: "No messages awaiting review" }),
      {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

async function updateMessageStatus(
  req: Request,
  env: Env,
  messageId?: string
): Promise<Response> {
  if (!messageId) {
    return new Response("Message ID is required", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  let data: UpdateMessageBody;
  try {
    data = await req.json();
  } catch (err) {
    return new Response("Invalid JSON body", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  const { status } = data;
  if (!status || (status !== "approved" && status !== "denied")) {
    return new Response("Invalid status. Must be 'approved' or 'denied'.", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  const updateStatement = await env.MY_DB.prepare(
    "UPDATE messages SET approvalStatus = ? WHERE id = ?"
  );
  await updateStatement.bind(status, messageId).run();
  return new Response("Message status updated successfully", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
