import { useAuth } from './context';
import { PageHeader } from './components';

type Section = { title: string; steps: string[] };

const shared: Section[] = [
  {
    title: 'Getting started',
    steps: [
      'Use the sidebar to open the area you need. The menu is filtered to your account permissions.',
      'Use the theme button in the top bar to switch between light and dark mode.',
      'Use your profile control to sign out when you finish, especially on a shared computer.',
    ],
  },
  {
    title: 'Common actions',
    steps: [
      'Create or edit records with the form controls, then wait for the success message before leaving the page.',
      'Use search, filters, and pagination to find records. Export or download buttons appear where a document is available.',
      'If a page cannot load, use Try again first. If it continues, contact your school administrator and include the page name.',
    ],
  },
];

const roleGuides: Record<string, { name: string; intro: string; sections: Section[] }> = {
  PLATFORM_SUPER_ADMIN: {
    name: 'Platform administrator',
    intro:
      'Manage school onboarding and platform-level access without entering a school workspace by mistake.',
    sections: [
      {
        title: 'School approvals',
        steps: [
          'Open School approvals to review pending schools.',
          'Approve or suspend schools only after checking their submitted details.',
        ],
      },
      {
        title: 'Account safety',
        steps: [
          'Use the audit trail to review important changes.',
          'Keep platform administrator credentials private and sign out after each session.',
        ],
      },
    ],
  },
  SCHOOL_OWNER: {
    name: 'School owner',
    intro: 'Set up the school, assign trusted administrators, and review the complete workspace.',
    sections: [
      {
        title: 'Recommended setup order',
        steps: [
          'Open School settings and confirm school details, branding, terms, and notification preferences.',
          'Create class levels, classes, subjects, staff, parents, and students under the relevant workspace areas.',
          'Review permissions and run a small attendance, result, fee, and document workflow before launch.',
        ],
      },
      {
        title: 'Daily work',
        steps: [
          'Use Overview for school health and quick actions.',
          'Use Audit trail to investigate changes or confirm who performed an action.',
          'Use Documents & reports to generate and download school documents.',
        ],
      },
    ],
  },
  SCHOOL_ADMIN: {
    name: 'School administrator',
    intro: 'Run the school workspace, maintain records, and coordinate staff activity.',
    sections: [
      {
        title: 'School operations',
        steps: [
          'Maintain students, parents, staff, classes, subjects, and academic terms.',
          'Use Communication for in-app and email updates where configured.',
          'Use School settings for approved school-wide preferences.',
        ],
      },
      {
        title: 'Checks before publishing',
        steps: [
          'Confirm the active term and class assignments.',
          'Review attendance and results for missing or duplicate entries.',
          'Verify fee structures and payment references before sharing balances.',
        ],
      },
    ],
  },
  PRINCIPAL: {
    name: 'Principal',
    intro:
      'Monitor the school day and approve the academic, attendance, finance, and communication work your role permits.',
    sections: [
      {
        title: 'Review routine',
        steps: [
          'Start on Overview for activity and exceptions.',
          'Review attendance, results, fees, and reports before leadership meetings.',
          'Use Communication to send approved school updates by email or in-app notification.',
        ],
      },
      {
        title: 'People and permissions',
        steps: [
          'Review staff and teacher records when responsibilities change.',
          'Ask a school owner or administrator to change permissions rather than sharing credentials.',
        ],
      },
    ],
  },
  TEACHER: {
    name: 'Teacher',
    intro:
      'Use your teacher portal to manage classes, attendance, results, timetable information, and learner progress.',
    sections: [
      {
        title: 'Teaching day',
        steps: [
          'Open My classes or My students to find your assigned learners.',
          'Use Attendance to mark or correct attendance according to school policy.',
          'Enter results only for your assigned subjects and classes, then review scores before submitting or publishing.',
        ],
      },
      {
        title: 'Learner support',
        steps: [
          'Use Performance to identify learners who may need support.',
          'Check Timetable and Calendar for scheduled lessons and events.',
          'Use Announcements and Notifications to read school updates.',
        ],
      },
    ],
  },
  ACCOUNTANT: {
    name: 'Accountant',
    intro:
      'Maintain fee structures, record payments accurately, and produce finance documents for the school.',
    sections: [
      {
        title: 'Finance workflow',
        steps: [
          'Create or review fee structures for the correct term and class.',
          'Apply charges once, then record payments with the correct date, method, reference, and idempotency details.',
          'Review balances and generate receipts only after confirming the payment record.',
        ],
      },
      {
        title: 'Controls',
        steps: [
          'Do not reuse payment references.',
          'Use the audit trail and payment history to investigate corrections or reversals.',
          'Share receipts through the authorized document and communication workflows.',
        ],
      },
    ],
  },
  STAFF: {
    name: 'Staff member',
    intro:
      'Use the areas granted by your school administrator to view learners, attendance, academics, and school updates.',
    sections: [
      {
        title: 'Working safely',
        steps: [
          'Only edit records when your role and school process allow it.',
          'Check the active term and selected class before entering information.',
          'Report incorrect access or learner information to a school administrator.',
        ],
      },
    ],
  },
  PARENT: {
    name: 'Parent or guardian',
    intro:
      'Follow your child’s school day, review attendance and results, and keep your contact details current.',
    sections: [
      {
        title: 'Follow your child',
        steps: [
          'Choose a child from the child selector when you have more than one linked child.',
          'Open Attendance, Results, Report cards, Fees, Payments, and Receipts to review the selected child.',
          'Use Timetable, Calendar, Announcements, and Notifications for school updates.',
        ],
      },
      {
        title: 'Your account',
        steps: [
          'Open My profile to update your phone and address.',
          'Change your password from Security and never share your login details.',
          'If a child is missing, contact the school administrator to link the account.',
        ],
      },
    ],
  },
};

export function UserManualPage() {
  const { session } = useAuth();
  const role = session?.user.role || 'STAFF';
  const guide = roleGuides[role] || roleGuides.STAFF;
  const sections = [...shared, ...guide.sections];
  return (
    <>
      <PageHeader
        eyebrow="HELP CENTRE"
        title="How to use ile-iwe"
        description={`${guide.name} guide · ${guide.intro}`}
      />
      <div className="manual-grid">
        {sections.map((section) => (
          <section className="panel manual-card" key={section.title}>
            <div className="panel-heading">
              <div>
                <h2>{section.title}</h2>
                <p>{guide.name}</p>
              </div>
            </div>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <section className="panel manual-note">
        <h2>Need help?</h2>
        <p>
          Contact your school administrator with the page name, what you were trying to do, and any
          reference or error message shown. Never send your password.
        </p>
      </section>
    </>
  );
}
