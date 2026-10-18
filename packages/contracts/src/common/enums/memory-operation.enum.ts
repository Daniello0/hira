/** How a newly extracted fact relates to one already stored. */
export enum MemoryOperation {
  Add = 'ADD',
  Update = 'UPDATE',
  Contradicts = 'CONTRADICTS',
}
