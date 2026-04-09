import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],

  rootDir: ".",

  testRegex: ".*\\.spec\\.ts$",

  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },

  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
    "^prisma/(.*)$": "<rootDir>/prisma/$1",
  },

  testEnvironment: "node",
};

export default config;