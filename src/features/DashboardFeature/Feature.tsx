import { useEffect, useReducer } from "react";
import {
  createContext,
  match,
  createHook,
  createReducer,
  useEnterEffect,
  useEvents,
} from "react-states";
import { useEnvironment } from "../../environment";
import {
  CalendarEventDTO,
  FamilyDTO,
  GroceryCategoryDTO,
  GroceryDTO,
  StorageEvent,
  TaskDTO,
  WeekDTO,
} from "../../environment/storage";
import { useSession } from "../SessionFeature";
import { getCurrentWeekId } from "../../utils";
import { useDevtools } from "react-states/devtools";
import { AuthenticationEvent, UserDTO } from "../../environment/authentication";
import levenshtein from "fast-levenshtein";

export type GroceryCategory = GroceryCategoryDTO;

export type Family = FamilyDTO;

export type User = UserDTO;

export type Grocery = GroceryDTO;

export type Groceries = Grocery[];

export type Task = TaskDTO;

export type CalendarEvent = CalendarEventDTO;

export type ViewContext =
  | {
      state: "WEEKDAYS";
    }
  | {
      state: "GROCERIES";
    }
  | {
      state: "SHOPPING_LIST";
    }
  | {
      state: "PLAN_CURRENT_WEEK";
    }
  | {
      state: "PLAN_NEXT_WEEK";
    };

export type Tasks = {
  [taskId: string]: Task;
};

export type CalendarEvents = {
  [eventId: string]: CalendarEvent;
};

export type Week = WeekDTO;

export type WeekdayTasks = {
  [taskId: string]: string[];
};

type FamilyDataContext =
  | {
      state: "LOADING";
    }
  | {
      state: "LOADED";
      family: Family;
      groceries: Groceries;
      tasks: Tasks;
      events: CalendarEvents;
    };

type WeeksDataContext =
  | {
      state: "LOADING";
    }
  | {
      state: "LOADED";
      previousWeek: Week;
      currentWeek: Week;
      nextWeek: Week;
    };

type Context =
  | {
      state: "AWAITING_AUTHENTICATION";
    }
  | {
      state: "REQUIRING_AUTHENTICATION";
    }
  | {
      state: "LOADING";
      user: User;
      familyData: FamilyDataContext;
      weeksData: WeeksDataContext;
    }
  | {
      state: "LOADED";
      family: Family;
      groceries: Groceries;
      tasks: Tasks;
      events: CalendarEvents;
      previousWeek: Week;
      currentWeek: Week;
      nextWeek: Week;
      view: ViewContext;
      user: User;
    }
  | {
      state: "ERROR";
      error: string;
    };

export type UIEvent =
  | {
      type: "VIEW_SELECTED";
      view: ViewContext;
    }
  | {
      type: "GROCERY_CATEGORY_TOGGLED";
      category: GroceryCategory;
    }
  | {
      type: "GROCERY_INPUT_CHANGED";
      input: string;
    }
  | {
      type: "ADD_GROCERY";
      name: string;
      category: GroceryCategory;
    };

type Event = UIEvent | AuthenticationEvent | StorageEvent;

const featureContext = createContext<Context, UIEvent>();

export const useFeature = createHook(featureContext);

const reducer = createReducer<Context, Event>({
  AWAITING_AUTHENTICATION: {
    "AUTHENTICATION:AUTHENTICATED": ({ user }) => ({
      state: "LOADING",
      familyData: {
        state: "LOADING",
      },
      weeksData: {
        state: "LOADING",
      },
      user,
    }),
    "AUTHENTICATION:UNAUTHENTICATED": () => ({
      state: "REQUIRING_AUTHENTICATION",
    }),
  },
  REQUIRING_AUTHENTICATION: {
    "AUTHENTICATION:AUTHENTICATED": ({ user }) => ({
      state: "LOADING",
      familyData: {
        state: "LOADING",
      },
      weeksData: {
        state: "LOADING",
      },
      user,
    }),
  },
  LOADING: {
    "STORAGE:FETCH_FAMILY_DATA_SUCCESS": (
      { groceries, tasks, family, events },
      context
    ) =>
      match(context.weeksData, {
        LOADING: (): Context => ({
          ...context,
          familyData: {
            state: "LOADED",
            groceries,
            tasks,
            family,
            events,
          },
        }),
        LOADED: ({ currentWeek, nextWeek, previousWeek }): Context => ({
          state: "LOADED",
          view: {
            state: "WEEKDAYS",
          },
          user: context.user,
          currentWeek,
          nextWeek,
          previousWeek,
          groceries,
          tasks,
          family,
          events,
        }),
      }),
    "STORAGE:WEEKS_UPDATE": (
      { previousWeek, currentWeek, nextWeek },
      context
    ) =>
      match(context.familyData, {
        LOADING: (): Context => ({
          ...context,
          weeksData: {
            state: "LOADED",
            previousWeek,
            currentWeek,
            nextWeek,
          },
        }),
        LOADED: ({ events, family, tasks, groceries }): Context => ({
          state: "LOADED",
          view: {
            state: "WEEKDAYS",
          },
          user: context.user,
          currentWeek,
          nextWeek,
          previousWeek,
          groceries,
          tasks,
          family,
          events,
        }),
      }),
    "STORAGE:FETCH_WEEKS_ERROR": ({ error }) => ({
      state: "ERROR",
      error,
    }),
    "STORAGE:FETCH_FAMILY_DATA_ERROR": ({ error }) => ({
      state: "ERROR",
      error,
    }),
  },
  LOADED: {
    "STORAGE:ADD_GROCERY_SUCCESS": ({ grocery }, context) => {
      return {
        ...context,
        groceries: [grocery].concat(context.groceries),
      };
    },
    "STORAGE:SET_GROCERY_SHOP_COUNT_SUCCESS": ({ grocery }, context) => {
      return {
        ...context,
        groceries: context.groceries.reduce<Grocery[]>(
          (aggr, existingGrocery) => {
            if (existingGrocery.id === grocery.id) {
              return aggr.concat(grocery);
            }

            return aggr.concat(existingGrocery);
          },
          []
        ),
      };
    },
    "STORAGE:CURRENT_WEEK_TASK_ACTIVITY_UPDATE": (
      { taskId, userId, activity },
      context
    ) => {
      return {
        ...context,
        currentWeek: {
          ...context.currentWeek,
          tasks: {
            ...context.currentWeek.tasks,
            [taskId]: {
              ...context.currentWeek.tasks[taskId],
              [userId]: activity,
            },
          },
        },
      };
    },
    "STORAGE:NEXT_WEEK_TASK_ACTIVITY_UPDATE": (
      { taskId, userId, activity },
      context
    ) => {
      return {
        ...context,
        nextWeek: {
          ...context.nextWeek,
          tasks: {
            ...context.nextWeek.tasks,
            [taskId]: {
              ...context.nextWeek.tasks[taskId],
              [userId]: activity,
            },
          },
        },
      };
    },
    VIEW_SELECTED: ({ view }, context) => ({
      ...context,
      view,
    }),
  },
  ERROR: {},
});

export type Props = {
  children: React.ReactNode;
  initialContext?: Context;
};

export const selectors = {
  groceriesByCategory: (groceries: Groceries) => {
    return groceries.sort((a, b) => {
      if (a.category > b.category) {
        return 1;
      } else if (a.category < b.category) {
        return -1;
      }

      return 0;
    });
  },
  filterGroceriesByCategory: (
    groceries: Groceries,
    category: GroceryCategory
  ): Groceries => groceries.filter((grocery) => grocery.category === category),
  filterGroceriesByInput: (groceries: Groceries, input: string) => {
    if (input) {
      const lowerCaseInput = input.toLocaleLowerCase();

      return groceries.filter((grocery) => {
        const lowerCaseGroceryName = grocery.name.toLowerCase();

        return (
          lowerCaseGroceryName.includes(lowerCaseInput) ||
          levenshtein.get(grocery.name.toLowerCase(), input.toLowerCase()) < 3
        );
      });
    }

    return groceries;
  },
  tasksByWeekday: (week: Week) => {
    const tasksByWeekday: [
      WeekdayTasks,
      WeekdayTasks,
      WeekdayTasks,
      WeekdayTasks,
      WeekdayTasks,
      WeekdayTasks,
      WeekdayTasks
    ] = [{}, {}, {}, {}, {}, {}, {}];

    for (let taskId in week.tasks) {
      for (let userId in week.tasks[taskId]) {
        week.tasks[taskId][userId].forEach((isActive, index) => {
          if (isActive) {
            if (!tasksByWeekday[index][taskId]) {
              tasksByWeekday[index][taskId] = [];
            }
            tasksByWeekday[index][taskId].push(userId);
          }
        });
      }
    }

    return tasksByWeekday;
  },
};

export const Feature = ({ children, initialContext }: Props) => {
  const { storage, authentication } = useEnvironment();
  const [session] = useSession();

  const matchSession = match(session);

  initialContext =
    initialContext ||
    matchSession<Context>({
      VERIFYING_AUTHENTICATION: () => ({
        state: "AWAITING_AUTHENTICATION",
      }),
      SIGNING_IN: () => ({
        state: "AWAITING_AUTHENTICATION",
      }),
      ERROR: () => ({
        state: "AWAITING_AUTHENTICATION",
      }),
      SIGNED_IN: ({ user }) => ({
        state: "LOADING",
        familyData: {
          state: "LOADING",
        },
        weeksData: {
          state: "LOADING",
        },
        user,
      }),
      SIGNED_OUT: () => ({
        state: "REQUIRING_AUTHENTICATION",
      }),
    });

  const feature = useReducer(reducer, initialContext);

  if (process.env.NODE_ENV === "development" && process.browser) {
    useDevtools("Dashboard", feature);
  }

  const [context, send] = feature;

  useEvents(authentication.events, send);
  useEvents(storage.events, send);

  useEnterEffect(context, "LOADING", ({ user }) => {
    storage.fetchFamilyData(user.familyId);
    storage.fetchWeeks(user.familyId);
  });

  return (
    <featureContext.Provider value={feature}>
      {children}
    </featureContext.Provider>
  );
};
