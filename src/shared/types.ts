export interface IPC_CHANNELS {
  'chat:sendMessage': (payload: { content: string; sessionId?: number }) => Promise<unknown>
  'chat:getMessages': (payload: { sessionId: number; limit?: number; offset?: number }) => Promise<unknown>
  'learning:getCurrentState': () => Promise<unknown>
  'settings:get': (key: string) => Promise<unknown>
  'settings:update': (key: string, value: string) => Promise<unknown>
}
