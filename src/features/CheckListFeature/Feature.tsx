import { useReducer } from "react";
import {
  createContext,
  createHook,
  createReducer,
  useEnterEffect,
} from "react-states";
import { useDevtools } from "react-states/devtools";
import { useEnvironment } from "../../environment";
import { StorageEvent } from "../../environment/storage";
import { Todo } from "../DashboardFeature";
import { CheckListItem, Todos } from "../DashboardFeature/Feature";
import { User } from "../SessionFeature";

type Context = {
  state: "LIST";
};

type TransientContext =
  | {
      state: "ARCHIVING_TODO";
      todoId: string;
    }
  | {
      state: "TOGGLING_CHECKLIST_ITEM";
      itemId: string;
    }
  | {
      state: "DELETING_CHECKLIST_ITEM";
      itemId: string;
    }
  | {
      state: "ADDING_CHECKLIST_ITEM";
      title: string;
      todoId: string;
    };

type UIEvent =
  | {
      type: "ARCHIVE_TODO";
      todoId: string;
    }
  | {
      type: "TOGGLE_CHECKLIST_ITEM";
      itemId: string;
    }
  | {
      type: "DELETE_CHECKLIST_ITEM";
      itemId: string;
    }
  | {
      type: "ADD_CHECKLIST_ITEM";
      title: string;
      todoId: string;
    };

type Event = UIEvent | StorageEvent;

const featureContext = createContext<Context, UIEvent, TransientContext>();

const reducer = createReducer<Context, Event, TransientContext>(
  {
    LIST: {
      ARCHIVE_TODO: ({ todoId }) => ({
        state: "ARCHIVING_TODO",
        todoId,
      }),
      TOGGLE_CHECKLIST_ITEM: ({ itemId }) => ({
        state: "TOGGLING_CHECKLIST_ITEM",
        itemId,
      }),
      DELETE_CHECKLIST_ITEM: ({ itemId }) => ({
        state: "DELETING_CHECKLIST_ITEM",
        itemId,
      }),
      ADD_CHECKLIST_ITEM: ({ title, todoId }) => ({
        state: "ADDING_CHECKLIST_ITEM",
        title,
        todoId,
      }),
    },
  },
  {
    ARCHIVING_TODO: (_, prevContext) => prevContext,
    TOGGLING_CHECKLIST_ITEM: (_, prevContext) => prevContext,
    DELETING_CHECKLIST_ITEM: (_, prevContext) => prevContext,
    ADDING_CHECKLIST_ITEM: (_, prevContext) => prevContext,
  }
);

export const useFeature = createHook(featureContext);

export const selectors = {
  sortedCheckListItems(checkListItems: { [itemId: string]: CheckListItem }) {
    return Object.values(checkListItems).sort((a, b) => {
      if (a.created > b.created) {
        return 1;
      }
      if (a.created < b.created) {
        return -1;
      }

      return 0;
    });
  },
  checkLists: (todos: Todos) =>
    Object.values(todos).filter((todo) => Boolean(todo.checkList)),
};

export const Feature = ({
  user,
  children,
  initialContext = {
    state: "LIST",
  },
}: {
  user: User;
  children: React.ReactNode;
  initialContext?: Context;
}) => {
  const { storage } = useEnvironment();
  const feature = useReducer(reducer, initialContext);

  if (process.env.NODE_ENV === "development" && process.browser) {
    useDevtools("Todos", feature);
  }

  const [context, send] = feature;

  useEnterEffect(context, "ARCHIVING_TODO", ({ todoId }) => {
    storage.archiveTodo(user.familyId, todoId);
  });

  useEnterEffect(context, "TOGGLING_CHECKLIST_ITEM", ({ itemId }) => {
    storage.toggleCheckListItem(user.familyId, user.id, itemId);
  });

  useEnterEffect(context, "DELETING_CHECKLIST_ITEM", ({ itemId }) => {
    storage.deleteChecklistItem(user.familyId, itemId);
  });

  useEnterEffect(context, "ADDING_CHECKLIST_ITEM", ({ title, todoId }) => {
    storage.addChecklistItem(user.familyId, todoId, title);
  });

  return (
    <featureContext.Provider value={feature}>
      {children}
    </featureContext.Provider>
  );
};
