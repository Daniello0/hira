/** Valid model payload for understand tests. Not part of the service build. */
export function validModelIntent(): Record<string, unknown> {
  return {
    rewrittenQuery: 'Junior Python developer, remote, Minsk',
    role: 'Python developer',
    skills: [{ surface: 'Python', required: true }],
    seniority: 'JUNIOR',
    hardConstraints: {
      workFormat: ['REMOTE'],
      employment: null,
      location: ['Minsk'],
      salaryMin: null,
    },
    softConstraints: [{ key: 'medicine', weight: 0.4 }],
    complexity: 'MODERATE',
    intentType: 'SEARCH',
  };
}
