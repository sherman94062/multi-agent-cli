// No custom tools registered for this project.
// web_search is a server-side tool handled directly by the Anthropic API —
// it is passed in the tools[] array but never dispatched through this registry.
//
// To add a custom tool:
//   1. Create src/tools/my_tool.ts exporting a RegisteredTool
//   2. Import and register it here: toolRegistry.register(myTool)

export { toolRegistry } from "./registry.js";
