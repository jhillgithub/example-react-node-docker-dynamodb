const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { dynamodb, docClient } = require("./config");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const tableName = "Users";

// Function to create the table if it doesn't exist
const createTableIfNotExists = async () => {
  const params = {
    TableName: tableName,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  };

  try {
    await dynamodb.createTable(params).promise();
    console.log(`Table ${tableName} created successfully`);
  } catch (error) {
    if (error.code !== "ResourceInUseException") {
      console.error(`Error creating table: ${error}`);
    }
  }
};

// Function to seed initial data
const seedData = async () => {
  const users = [
    { id: uuidv4(), name: "John Doe", email: "john@example.com" },
    { id: uuidv4(), name: "Jane Smith", email: "jane@example.com" },
  ];

  for (const user of users) {
    const params = {
      TableName: tableName,
      Item: user,
    };

    try {
      await docClient.put(params).promise();
      console.log(`User ${user.name} added successfully`);
    } catch (error) {
      console.error(`Error adding user: ${error}`);
    }
  }
};

// Initialize database
const initializeDatabase = async () => {
  await createTableIfNotExists();
  const { Count } = await docClient
    .scan({ TableName: tableName, Select: "COUNT" })
    .promise();
  if (Count === 0) {
    await seedData();
  }
};

// CRUD operations (Create, Read, Update, Delete)

// Create
app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  const user = { id: uuidv4(), name, email };
  const params = {
    TableName: tableName,
    Item: user,
  };

  try {
    await docClient.put(params).promise();
    res.status(201).json(user);
  } catch (error) {
    console.error(`Error creating user: ${error}`);
    res.status(500).json({ error: "Error creating user" });
  }
});

// Read (all)
app.get("/users", async (req, res) => {
  const params = {
    TableName: tableName,
  };

  try {
    const data = await docClient.scan(params).promise();
    res.json(data.Items);
  } catch (error) {
    console.error(`Error fetching users: ${error}`);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// Read (single)
app.get("/users/:id", async (req, res) => {
  const params = {
    TableName: tableName,
    Key: { id: req.params.id },
  };

  try {
    const data = await docClient.get(params).promise();
    if (data.Item) {
      res.json(data.Item);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error(`Error fetching user: ${error}`);
    res.status(500).json({ error: "Error fetching user" });
  }
});

// Update
app.put("/users/:id", async (req, res) => {
  const { name, email } = req.body;
  const params = {
    TableName: tableName,
    Key: { id: req.params.id },
    UpdateExpression: "set #n = :n, #e = :e",
    ExpressionAttributeNames: { "#n": "name", "#e": "email" },
    ExpressionAttributeValues: { ":n": name, ":e": email },
    ReturnValues: "ALL_NEW",
  };

  try {
    const data = await docClient.update(params).promise();
    res.json(data.Attributes);
  } catch (error) {
    console.error(`Error updating user: ${error}`);
    res.status(500).json({ error: "Error updating user" });
  }
});

// Delete
app.delete("/users/:id", async (req, res) => {
  const params = {
    TableName: tableName,
    Key: { id: req.params.id },
  };

  try {
    await docClient.delete(params).promise();
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(`Error deleting user: ${error}`);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// Initialize database and start the server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Backend app listening at http://localhost:${port}`);
  });
});
