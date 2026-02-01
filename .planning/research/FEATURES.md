# Feature Landscape

**Domain:** Farm Chore Tracking PWA with Multi-User Collaboration
**Researched:** 2026-02-01
**Confidence:** MEDIUM (based on domain expertise in task management, collaborative apps, and PWA patterns)

## Table Stakes

Features users expect from any chore/task tracking application. Missing these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task completion toggle | Core function of any task app | Low | One-tap complete/uncomplete |
| Task list view | Users need to see what needs doing | Low | Organized, scannable list |
| Completion status persistence | Completed tasks must stay completed | Low | Database sync required |
| Visual completion feedback | Users need confirmation their action registered | Low | Checkbox, strikethrough, color change |
| Task grouping/organization | Without organization, lists become unwieldy | Medium | Time-of-day + animal category for this app |
| Progress indicator | Users want to know "how much is left" | Low | Simple count or percentage |
| Offline functionality | Farm context: connectivity unreliable | High | Service worker + IndexedDB + sync queue |
| Mobile-friendly UI | Used in field on phones | Medium | Touch targets, responsive design |
| Pull-to-refresh / manual sync | Users want control over data freshness | Low | Standard mobile pattern |
| Loading states | Users need feedback during operations | Low | Spinners, skeletons, etc. |
| Error handling with recovery | Network failures will happen | Medium | Retry logic, clear error messages |

### Multi-User Specific Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time sync | Core value prop: see others' work instantly | High | Convex handles this well |
| Conflict prevention | Two people shouldn't complete same task unknowingly | Medium | Optimistic UI with real-time updates |
| Activity visibility | "Who did what" for coordination | Medium | Show completer name/initials |
| User identification | Need to know who completed each task | Low | Anonymous keys still need display names |

### Photo Verification Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Camera capture | Primary photo input method in field | Medium | Native camera API |
| Photo preview before save | Users want to verify photo quality | Low | Show captured image |
| Photo attachment to task | Core verification requirement | Medium | File upload + storage |
| Photo viewing | Users/admins need to see verification photos | Low | Lightbox or full-screen view |
| Photo requirement indicator | Users must know which tasks need photos | Low | Icon or badge on task |

## Differentiators

Features that could set this app apart from generic task managers. Not strictly expected, but valuable for the farm context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Time-of-day organization** | Morning/afternoon/evening fits farm rhythm perfectly | Low | Already planned; natural workflow match |
| **Animal category grouping** | Logical mental model for farm workers | Low | Already planned; intuitive organization |
| **Master list → daily clone** | Fresh start each day, consistent template | Medium | Unique workflow; reduces cognitive load |
| **Photo requirement per-chore config** | Not all chores need verification | Low | Flexibility for admin |
| **Quick-complete gestures** | Swipe to complete for dirty hands | Medium | Reduces taps; field-friendly |
| **Today/history toggle** | See what's done vs what was done | Low | 7-day history already planned |
| **Ad-hoc chore addition** | Handle unexpected tasks without editing master | Low | Already planned; real-world flexibility |
| **Completion timestamps** | When was each chore done | Low | Useful for tracking patterns |
| **Batch operations** | Complete multiple related chores at once | Medium | "All morning sheep chores done" |
| **Notes/comments on completion** | "Noticed sheep limping" type observations | Medium | Beyond yes/no completion |
| **Photo gallery per day** | Quick review of all verification photos | Low | Admin convenience |
| **Undo with timeout** | Accidentally completed? Quick undo | Low | Error recovery; better UX |

### Admin-Specific Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Master list editing** | Configure chore template | Medium | Core admin function |
| **Drag-to-reorder** | Customize task order within groups | Medium | Better than manual ordering |
| **Key management dashboard** | See who has access, revoke if needed | Low | Security and control |
| **Activity log** | Audit trail of completions | Medium | Accountability |
| **Export data** | Download history for records | Low | Compliance/records |

## Anti-Features

Features to deliberately NOT build. Common in similar apps but wrong for this context.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Push notifications** | Already scoped out. Users check app when ready; notifications would be annoying in farm context | Rely on active polling/real-time UI updates |
| **Chore assignment to users** | Complicates coordination; first-come-first-served is simpler and fits farm culture | Show who completed, not who should complete |
| **Due dates/deadlines per task** | Time-of-day slots are sufficient; hard deadlines add stress without value | Visual time-slot grouping is enough |
| **Priority levels** | All farm chores are equally important (animals need care) | Task ordering within groups is sufficient |
| **Tags/labels system** | Over-engineering; categories handle organization | Stick with animal categories |
| **Subtasks/checklists** | Adds complexity; each chore should be atomic | If chore needs subtasks, split into separate chores |
| **Recurring task scheduling** | Already scoped out. Daily clone from master is simpler mental model | Master list is the "schedule" |
| **Calendar view** | Overkill for daily chores; adds unnecessary UI complexity | Today view + history is sufficient |
| **Integration with other apps** | Scope creep; standalone app is sufficient | Keep focused on core value |
| **Gamification (points, streaks)** | Farm work is not a game; feels patronizing | Simple progress indicator instead |
| **Social features (likes, comments)** | Not a social app; would clutter interface | Notes for observations only |
| **Complex user profiles** | Already scoped out. Key-based access is anonymous | Display name per key is enough |
| **Multi-farm support** | Already scoped out. Single deployment per farm | Keep simple architecture |
| **Offline-first photo editing** | Complexity vs value is poor; capture is enough | Simple capture, no filters/crop |
| **Search functionality** | Task list is short enough to scan | Good organization eliminates need |
| **Archive completed tasks** | 7-day auto-cleanup is cleaner | Automatic history management |

## Feature Dependencies

```
Foundation Layer (must exist first):
├── User authentication (admin + keys)
├── Database integration (Convex)
├── Basic task list rendering
└── PWA shell (service worker, manifest)

Core Functionality (build on foundation):
├── Master list CRUD (requires: auth, database)
├── Daily clone workflow (requires: master list)
├── Task completion (requires: daily list, database)
├── Real-time sync (requires: Convex integration)
└── Offline queue (requires: service worker, database)

Photo Features (build on core):
├── Camera capture (requires: task completion exists)
├── Photo upload (requires: Convex file storage)
├── Photo requirement config (requires: master list editing)
└── Photo viewing (requires: photo upload)

Polish Features (build on everything):
├── Completion timestamps (requires: task completion)
├── User identification on tasks (requires: auth)
├── History view (requires: completion data)
└── Admin activity log (requires: all tracking)
```

## MVP Recommendation

For MVP, prioritize in this order:

### Must Have (Phase 1-2)
1. **PWA shell** — Installable, works offline (even if limited)
2. **Admin authentication** — Protect master list editing
3. **Master list CRUD** — Create/edit chore template
4. **User key access** — Allow workers to use app
5. **Daily list view** — See today's chores organized by time/animal

### Must Have (Phase 3-4)
6. **Task completion toggle** — Core interaction
7. **Real-time sync** — Multiple users see updates
8. **Basic offline support** — Queue completions when offline
9. **Photo capture + attachment** — Verification workflow
10. **Progress indicator** — Know how much is left

### Defer to Post-MVP
- **Batch operations** — Nice but not essential
- **Notes/comments** — Can live without initially
- **Activity log** — Admin convenience, not critical
- **History view** — Can be simplified initially (just "completed today")
- **Ad-hoc chore addition** — Start with master list only

## Farm Context Considerations

### What Makes Farm Different from Generic Task Apps

1. **Environmental constraints**: Users may have dirty/wet hands, gloves, poor lighting, animals demanding attention
2. **Connectivity issues**: Rural areas, barns with poor signal, outdoor work
3. **Time pressure**: Animals need timely care; can't spend time fiddling with UI
4. **Multiple workers**: Coordination is key; duplicated effort wastes time
5. **Verification needs**: Some tasks (medication, feeding amounts) need proof
6. **Weather dependency**: Outdoor work affected by conditions

### UX Implications

| Constraint | UX Response |
|------------|-------------|
| Dirty hands | Large touch targets, swipe gestures, minimal typing |
| Poor connectivity | Aggressive offline support, optimistic UI |
| Time pressure | One-tap completion, minimal navigation |
| Multiple workers | Real-time updates, clear "who did what" |
| Verification | Simple camera capture, not photo editing |
| Outdoor use | High contrast, visible in sunlight |

## Competitive Landscape (Domain Knowledge)

### Generic Task Apps (Todoist, Things, TickTick)
- Too feature-rich for simple chore tracking
- Not designed for multi-user real-time coordination
- Poor offline support typically

### Team Task Apps (Asana, Monday, Trello)
- Overkill for daily repeating tasks
- Designed for project management, not daily chores
- Complex onboarding not suitable for farm workers

### Chore Apps (OurHome, Tody, Sweepy)
- Designed for household chores
- Often gamified (inappropriate for farm)
- Limited real-time multi-user support

### Farm Management Software (Farmbrite, Farmote, Growthin)
- Full farm management (crops, livestock, finances)
- Complex, expensive, steep learning curve
- Not focused on daily chore coordination

### Gap This App Fills
- Simple, focused chore tracking
- Real-time multi-user coordination
- Offline-first for rural use
- Photo verification where needed
- No unnecessary complexity

---

*Features research: 2026-02-01*
