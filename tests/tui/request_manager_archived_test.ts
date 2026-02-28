/**
 * @module RequestManagerArchivedTest
 * @path tests/tui/request_manager_archived_test.ts
 * @description Verifies the RequestManagerView TUI component's ability to toggle and display archived requests.
 */
import { assertEquals } from "@std/assert";
import { IRequestOptions, IRequestService, RequestManagerTuiSession } from "../../src/tui/request_manager_view.ts";
import { IRequest } from "../../src/shared/types/request.ts";
import { RequestStatus, RequestStatusType } from "../../src/shared/status/request_status.ts";
import { RequestPriority } from "../../src/shared/enums.ts";

class MockRequestService implements IRequestService {
  public listCalledWithIncludeArchived = false;

  listRequests(_status?: RequestStatusType, includeArchived?: boolean): Promise<IRequest[]> {
    this.listCalledWithIncludeArchived = !!includeArchived;
    const requests: IRequest[] = [
      {
        trace_id: "trace1",
        filename: "req1.md",
        subject: "Request 1",
        status: RequestStatus.PENDING,
        priority: RequestPriority.NORMAL,
        agent: "agent1",
        created: new Date().toISOString(),
        created_by: "user1",
        source: "cli",
      },
    ];
    if (includeArchived) {
      requests.push({
        trace_id: "trace2",
        filename: "req2.md",
        subject: "Archived Request",
        status: RequestStatus.COMPLETED,
        priority: RequestPriority.LOW,
        agent: "agent1",
        created: new Date().toISOString(),
        created_by: "user1",
        source: "cli",
      });
    }
    return Promise.resolve(requests);
  }

  getRequestContent(_requestId: string): Promise<string> {
    return Promise.resolve("content");
  }

  createRequest(_description: string, _options?: IRequestOptions): Promise<IRequest> {
    return Promise.resolve({} as IRequest);
  }

  updateRequestStatus(_requestId: string, _status: RequestStatusType): Promise<boolean> {
    return Promise.resolve(true);
  }
}

Deno.test("RequestManagerTuiSession - toggle show archived", async () => {
  const service = new MockRequestService();
  const initialRequests = await service.listRequests();
  const session = new RequestManagerTuiSession(initialRequests, service);

  assertEquals(session.getState().showArchived, false);
  assertEquals(service.listCalledWithIncludeArchived, false);

  // Toggle archived
  await session.toggleShowArchived();

  assertEquals(session.getState().showArchived, true);
  assertEquals(service.listCalledWithIncludeArchived, true);
  assertEquals(session.getRequests().length, 2);

  // Toggle back
  await session.toggleShowArchived();

  assertEquals(session.getState().showArchived, false);
  assertEquals(service.listCalledWithIncludeArchived, false);
  assertEquals(session.getRequests().length, 1);
});
