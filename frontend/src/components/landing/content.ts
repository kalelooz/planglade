export const landingNavLinks = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Open source', href: '#open-source' },
  { label: 'FAQ', href: '#faq' },
] as const

export const landingFaqItems = [
  {
    question: 'What is PlanGlade?',
    answer:
      'PlanGlade is a personal planning workspace for capturing tasks, organizing projects, keeping notes, and viewing the same work as a list, board, timeline, calendar, or connection map.',
  },
  {
    question: 'How is it different from a normal task manager?',
    answer:
      'A task is one shared record rather than a copy made for each view. Change it once and the updated work remains visible wherever you choose to plan it.',
  },
  {
    question: 'What does Quick Capture do?',
    answer:
      'Quick Capture turns natural shorthand into a task with useful structure, such as its project and due date, while keeping the original thought easy to review.',
  },
  {
    question: 'Do I need to organize everything immediately?',
    answer:
      'No. Capture work into Inbox first, then add more structure when you are ready. PlanGlade is designed to let organization happen gradually.',
  },
  {
    question: 'Can I self-host PlanGlade?',
    answer:
      'Yes. The open-source edition is available under the MIT License, with setup guidance in the public repository.',
  },
  {
    question: 'Does PlanGlade currently support teams?',
    answer:
      'The current hosted release provides personal workspaces. Shared workspaces and invitations are not enabled yet.',
  },
  {
    question: 'Is PlanGlade an AI product?',
    answer: 'No. The current product focuses on direct, predictable planning tools.',
  },
  {
    question: 'Where do I sign in?',
    answer:
      'Use the Sign in link in the navigation or footer. After authentication, PlanGlade opens your personal workspace.',
  },
] as const
