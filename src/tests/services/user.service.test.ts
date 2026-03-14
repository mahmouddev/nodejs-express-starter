import "reflect-metadata";
import { UserService } from "../../services/user.service";
import bcrypt from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";

// ============================================================
// STEP 1: Set environment variables BEFORE any test runs
// ============================================================
process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

// ============================================================
// STEP 2: Create a MOCK repository
//
// Why mock?
// - We don't want tests to hit a real database
// - Tests should be fast and isolated
// - We control exactly what the repo returns
//
// jest.fn() creates a fake function that:
// - Records how many times it was called
// - Records what arguments it received
// - Can be configured to return specific values
// ============================================================
const mockUserRepo = {
    all: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findByEmail: jest.fn(),
    createRefreshToken: jest.fn(),
    deleteRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
};

// ============================================================
// STEP 3: Create the service with the mock injected
//
// Instead of: container.resolve(UserService) → real DB
// We do:      new UserService(mockUserRepo)   → fake DB
//
// This is WHY Dependency Injection matters for testing.
// The service doesn't know or care if the repo is real or fake.
// ============================================================
const userService = new UserService(mockUserRepo as any);

// ============================================================
// STEP 4: Reset mocks before each test
//
// Why? Each test should be independent.
// If test A configures mockUserRepo.findByEmail to return a user,
// test B should NOT see that configuration.
// ============================================================
beforeEach(() => {
    jest.clearAllMocks();
});

// ============================================================
// STEP 5: Write the tests
//
// Structure: describe → group of related tests
//            it       → single test case
//
// Pattern: AAA (Arrange → Act → Assert)
//   Arrange: set up the data and mocks
//   Act:     call the method
//   Assert:  check the result
// ============================================================

describe("UserService", () => {

    // ---- register() tests ----

    describe("register()", () => {

        it("should hash the password before saving", async () => {
            // Arrange: configure mock to return a fake user
            mockUserRepo.create.mockResolvedValue({
                id: 1,
                name: "Mahmoud",
                email: "mahmoud@test.com",
                role: "user",
            });

            // Act: call register
            await userService.register({
                name: "Mahmoud",
                email: "mahmoud@test.com",
                password: "123456",
            });

            // Assert: check that create was called with a HASHED password
            const savedData = mockUserRepo.create.mock.calls[0][0];

            //  password should NOT be plain text
            expect(savedData.password).not.toBe("123456");

            // password should be a valid bcrypt hash
            const isHashed = await bcrypt.compare("123456", savedData.password);
            expect(isHashed).toBe(true);
        });

        it("should pass name and email unchanged", async () => {
            // Arrange
            mockUserRepo.create.mockResolvedValue({ id: 1 });

            // Act
            await userService.register({
                name: "Mahmoud",
                email: "mahmoud@test.com",
                password: "123456",
            });

            // Assert
            const savedData = mockUserRepo.create.mock.calls[0][0];
            expect(savedData.name).toBe("Mahmoud");
            expect(savedData.email).toBe("mahmoud@test.com");
        });
    });

    // ---- login() tests ----

    describe("login()", () => {

        it("should return accessToken and refreshToken on valid credentials", async () => {
            // Arrange: create a user with hashed password
            const hashedPassword = await bcrypt.hash("123456", 10);
            mockUserRepo.findByEmail.mockResolvedValue({
                id: 1,
                email: "mahmoud@test.com",
                role: "user",
                password: hashedPassword,
            });
            mockUserRepo.createRefreshToken.mockResolvedValue(undefined);

            // Act
            const result = await userService.login({
                email: "mahmoud@test.com",
                password: "123456",
            });

            // Assert: should return both tokens
            expect(result).toHaveProperty("accessToken");
            expect(result).toHaveProperty("refreshToken");

            // Verify the access token contains correct data
            const decoded = jsonwebtoken.verify(result.accessToken, "test-secret") as any;
            expect(decoded.email).toBe("mahmoud@test.com");
            expect(decoded.role).toBe("user");
        });

        it("should throw error if user not found", async () => {
            // Arrange: findByEmail returns null
            mockUserRepo.findByEmail.mockResolvedValue(null);

            // Act & Assert: expect it to throw
            await expect(
                userService.login({ email: "nobody@test.com", password: "123456" })
            ).rejects.toThrow("User not found");
        });

        it("should throw error if password is wrong", async () => {
            // Arrange: user exists but password won't match
            const hashedPassword = await bcrypt.hash("correctPassword", 10);
            mockUserRepo.findByEmail.mockResolvedValue({
                id: 1,
                email: "mahmoud@test.com",
                password: hashedPassword,
            });

            // Act & Assert
            await expect(
                userService.login({ email: "mahmoud@test.com", password: "wrongPassword" })
            ).rejects.toThrow("Invalid password");
        });

        it("should save refresh token to database", async () => {
            // Arrange
            const hashedPassword = await bcrypt.hash("123456", 10);
            mockUserRepo.findByEmail.mockResolvedValue({
                id: 1,
                email: "mahmoud@test.com",
                role: "user",
                password: hashedPassword,
            });
            mockUserRepo.createRefreshToken.mockResolvedValue(undefined);

            // Act
            await userService.login({ email: "mahmoud@test.com", password: "123456" });

            // Assert: createRefreshToken was called with userId and a token
            expect(mockUserRepo.createRefreshToken).toHaveBeenCalledTimes(1);
            expect(mockUserRepo.createRefreshToken.mock.calls[0][0]).toBe(1); // userId
        });
    });

    // ---- logout() tests ----

    describe("logout()", () => {

        it("should delete the refresh token from database", async () => {
            // Arrange
            mockUserRepo.deleteRefreshToken.mockResolvedValue(undefined);

            // Act
            await userService.logout("some-refresh-token");

            // Assert
            expect(mockUserRepo.deleteRefreshToken).toHaveBeenCalledWith("some-refresh-token");
        });
    });

    // ---- generateToken() tests ----

    describe("generateToken()", () => {

        it("should return a valid JWT with user data", async () => {
            // Act
            const token = await userService.generateToken({
                id: 1,
                email: "mahmoud@test.com",
                role: "admin",
            });

            // Assert: decode and check payload
            const decoded = jsonwebtoken.verify(token, "test-secret") as any;
            expect(decoded.id).toBe(1);
            expect(decoded.email).toBe("mahmoud@test.com");
            expect(decoded.role).toBe("admin");
        });
    });
});
