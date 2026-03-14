import type { Config } from "jest";

const config: Config = {
    // Use ts-jest to compile TypeScript files
    preset: "ts-jest",

    // Run tests in Node environment (not browser)
    testEnvironment: "node",

    // Where to find test files
    roots: ["<rootDir>/src"],

    // Match test files — any .test.ts or .spec.ts
    testMatch: ["**/*.test.ts", "**/*.spec.ts"],

    // ts-jest needs these for decorators to work
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
                // These 2 lines are CRITICAL for tsyringe decorators
                // Without them: reflect-metadata won't work → DI breaks
            },
        ],
    },

    // Auto-import reflect-metadata before every test file
    // Without this: @injectable() and @inject() throw errors
    setupFiles: ["reflect-metadata"],
};

export default config;
