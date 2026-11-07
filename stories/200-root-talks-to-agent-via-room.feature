Feature: ROOT opens Rooms, opens a specific room and talks to an agent

  "i want all Node Agents to be in the Node Room"
  "and i will also connect the Node Room to a Telegram group i have"
  "not everything is completely doable yet, but i hope this gives an idea of where i want to be."

  Background:
    Given I am ROOT

  Scenario: ROOT opens the Node Room
    When I open the leftside bar
    And I open the Rooms Element
    And I open a specific Room, like the Node Room
    Then I am in the Node Room Element
    And here I see what it's connected to and what Agents are in it

  Scenario: ROOT says something to an Agent in the room
    Given I am in the Node Room Element
    When I press on an Agent
    Then `@agent_name` appears in the inputfield and I can type something
    When I press send
    Then the message gets to the Agent via the room
    And the Agent can put something back into the room

  Scenario: The human user is told on the phone
    Given an Agent put something back into the room
    Then a push notification happens for the human user
    And I open the result in the phone app
