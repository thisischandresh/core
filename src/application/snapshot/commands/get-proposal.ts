import {
  Command,
  FailureResult,
  HandlerError,
  HandlerResponseError,
  OkResult,
} from 'shared/messaging';
import {
  GetIdToTwitterHandleCommand,
  GetReverseIdrissCommand,
} from 'shared/idriss';

import { ProposalData } from '../types';
import { generateGetProposalsQuery } from '../utils';
import { SNAPSHOT_GRAPHQL_API_URL } from '../constants';
import { getProposalsResponseSchema } from '../schema';

type Payload = {
  snapshotNames: string[];
  pageNumber: number;
};

type Response = {
  proposal: ProposalData | null;
  hasNextProposal: boolean;
};

export class GetProposalCommand extends Command<Payload, Response> {
  public readonly name = 'GetProposalCommand' as const;

  constructor(public payload: Payload) {
    super();
  }

  async handle() {
    try {
      const query = generateGetProposalsQuery();
      const response = await fetch(SNAPSHOT_GRAPHQL_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          query: query,
          operationName: 'Proposals',
          variables: {
            first: 2,
            snapshotNames: this.payload.snapshotNames,
            skip: this.payload.pageNumber,
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new HandlerResponseError(
          this.name,
          responseText,
          response.status,
        );
      }
      const json = await response.json();
      const validationResult = getProposalsResponseSchema.safeParse(json);
      if (!validationResult.success) {
        throw new HandlerError('Schema validation failed');
      }
      const [currentProposal, nextProposal] =
        validationResult.data.data.proposals;
      const hasNextProposal = Boolean(nextProposal);
      if (!currentProposal) {
        return new OkResult({
          proposal: null,
          hasNextProposal: false,
        });
      }

      const author = '0xcCE9A28b570946123f392Cf1DbfA6D2D5e636a1f'; // currentProposal.author

      const reverseIdrissCommand = new GetReverseIdrissCommand({
        addresses: [author],
      });
      const reverseIdrissResult = await reverseIdrissCommand.handle();
      let resolvedAddress: string | undefined;
      let twitterId: string | undefined;
      if (!('reason' in reverseIdrissResult)) {
        const lookup = (
          reverseIdrissResult as OkResult<Record<string, string | undefined>>
        ).data;
        twitterId = lookup[author] ?? undefined;
      }

      if (twitterId) {
        const idToTwitterCommand = new GetIdToTwitterHandleCommand({
          ids: [twitterId],
        });
        const idToTwitterResult = await idToTwitterCommand.handle();

        if (!('reason' in idToTwitterResult)) {
          const lookup = (idToTwitterResult as OkResult<Record<string, string>>)
            .data;
          resolvedAddress = lookup[twitterId];
        }
      }

      return new OkResult({
        proposal: {
          ...currentProposal,
          author: {
            address: currentProposal.author,
            resolvedAddress,
          },
        },
        hasNextProposal,
      });
    } catch (error) {
      this.captureException(error);
      if (error instanceof HandlerError) {
        return new FailureResult(error.message);
      }

      return new FailureResult();
    }
  }
}
