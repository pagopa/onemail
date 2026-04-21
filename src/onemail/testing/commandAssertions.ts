import { expect } from 'vitest';

type CommandMock = { mock: { calls: unknown[][] } };

export const getNthCommand = (mock: CommandMock, index = 0) =>
  mock.mock.calls[index]?.[0];

export const expectCommandInput = (
  mock: CommandMock,
  expected: Record<string, unknown>,
  index = 0,
) => {
  const command = getNthCommand(mock, index) as { input?: unknown };
  expect(command).toBeDefined();
  expect(command.input).toMatchObject(expected);
  return command;
};
