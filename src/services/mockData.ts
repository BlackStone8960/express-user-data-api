import { User } from "../types";

export const mockUsers: Record<number, User> = {
  1: {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  },
  2: {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
  },
  3: {
    id: 3,
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: new Date("2023-01-03"),
    updatedAt: new Date("2023-01-03"),
  },
  4: {
    id: 4,
    name: "Bob Wilson",
    email: "bob@example.com",
    createdAt: new Date("2023-01-04"),
    updatedAt: new Date("2023-01-04"),
  },
  5: {
    id: 5,
    name: "Carol Brown",
    email: "carol@example.com",
    createdAt: new Date("2023-01-05"),
    updatedAt: new Date("2023-01-05"),
  },
};

// Global users state (module-level)
let users: Record<number, User> = { ...mockUsers };

const simulateDatabaseDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getUserById = async (id: number): Promise<User | null> => {
  await simulateDatabaseDelay(200);
  const user = users[id];
  return user ? { ...user } : null;
};

export const createUser = async (
  userData: Omit<User, "id" | "createdAt" | "updatedAt">
): Promise<User> => {
  await simulateDatabaseDelay(150);

  const newId = Math.max(...Object.keys(users).map(Number)) + 1;
  const now = new Date();

  const newUser: User = {
    id: newId,
    ...userData,
    createdAt: now,
    updatedAt: now,
  };

  users[newId] = newUser;
  return { ...newUser };
};

export const updateUser = async (
  id: number,
  userData: Partial<Omit<User, "id" | "createdAt">>
): Promise<User | null> => {
  await simulateDatabaseDelay(150);

  const existingUser = users[id];
  if (!existingUser) {
    return null;
  }

  const updatedUser: User = {
    ...existingUser,
    ...userData,
    updatedAt: new Date(),
  };

  users[id] = updatedUser;
  return { ...updatedUser };
};

export const deleteUser = async (id: number): Promise<boolean> => {
  await simulateDatabaseDelay(100);

  if (users[id]) {
    delete users[id];
    return true;
  }
  return false;
};

export const getAllUsers = (): User[] => {
  return Object.values(users).map((user) => ({ ...user }));
};

export const getUserCount = (): number => {
  return Object.keys(users).length;
};

export const resetUsers = (): void => {
  users = { ...mockUsers };
};
