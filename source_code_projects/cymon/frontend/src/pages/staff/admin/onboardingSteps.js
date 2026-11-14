export const createOnboardingSteps = (dashboards, options = {}) => {
  const {
    welcomeTitle = 'Welcome to the Admin Dashboard',
    welcomeText = 'This tour explains each sidebar button first, then moves into that dashboard to explain its sections and actions.',
  } = options

  return [
    {
      key: 'welcome',
      path: dashboards[0]?.path || '/',
      targetKeys: [],
      title: welcomeTitle,
      text: welcomeText,
    },
    ...dashboards.flatMap((dashboard) => [
      {
        key: `${dashboard.key}-sidebar`,
        path: dashboard.path,
        targetKeys: [dashboard.key],
        title: `${dashboard.label} Sidebar Button`,
        text: dashboard.sidebarText,
      },
      {
        key: `${dashboard.key}-dashboard`,
        path: dashboard.path,
        targetKeys: [...new Set([dashboard.workspaceKey, ...dashboard.controlKeys, ...dashboard.detailTargetKeys])],
        title: `${dashboard.label} Dashboard`,
        callouts: [
          { targetKey: dashboard.workspaceKey, label: `${dashboard.label} workspace`, text: dashboard.dashboardText },
          ...dashboard.details.map((detail, index) => ({
            ...detail,
            targetKey: dashboard.detailTargetKeys[index] || dashboard.workspaceKey,
          })),
        ],
      },
    ]),
  ]
}
