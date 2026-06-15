module.exports = {
  apps: [
    {
      name: "macro-market-monitor",
      command: "npm",
      args: "run start:prod",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "macro-market-scheduler",
      command: "npm",
      args: "run scheduler",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
