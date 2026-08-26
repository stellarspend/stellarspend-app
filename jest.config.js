// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^\\./wasmLoader$": "<rootDir>/lib/zk/__mocks__/wasmLoader.ts",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@stellar|@noble|@noir-lang|@aztec|uint8array-extras)/)",
  ],
};

module.exports = async () => {
  const makeConfig = createJestConfig(customJestConfig);
  const config = await makeConfig();
  config.transformIgnorePatterns = [
    "/node_modules/(?!(@stellar|@noble|@noir-lang|@aztec|uint8array-extras)/)",
  ];
  return config;
};
