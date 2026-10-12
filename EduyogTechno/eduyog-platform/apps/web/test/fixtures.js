// Small hand-written fixtures for unit tests (shapes follow the API responses the pages read).
export const assignmentFixtures = {
  none: { latestSubmission: null },
  onTime: { latestSubmission: { isLate: false } },
  late: { latestSubmission: { isLate: true } },
}
