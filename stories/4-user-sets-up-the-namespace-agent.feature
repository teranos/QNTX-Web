Feature: USER sets up the namespace agent

  Agent setup is its own thing, skippable as part of namespace creation, but still something you probably want to setup

  Scenario Outline: USER sets up the agent in <agent>
    Given I am at agent setup
    When I choose <agent>
    Then <story> starts
    And the agent is governed by ground and its pbt syntax
    And I am not involved with the pbt, because things just work

    Examples:
      | agent       | story                                             |
      | Claude Code | 22-user-signs-claude-code-in.feature              |
      | Pi          | 16-user-runs-the-namespace-agent-in-pi.feature    |
      | Codex       | 23-user-runs-the-namespace-agent-in-codex.feature |
      | Agy         | 24-user-runs-the-namespace-agent-in-agy.feature   |

  Scenario: USER skips agent setup
    Given I am at agent setup, as part of namespace creation
    When I skip it
    Then namespace creation goes on without an agent
