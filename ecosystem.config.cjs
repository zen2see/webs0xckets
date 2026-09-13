module.exports = {
  apps: [
    {
      name: "chat-backend",
      script: "./server.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};

