Feature: ROOT opens Rooms, opens a specific room and talks to an agent

  "i want all Node Agents to be in the Node Room"
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

  Scenario: An agent returns a picture to work on together
    Given I am in the Node Room Element
    When I ask an Agent for a picture in the room
    Then its picture arrives inside its reply
    And I can save the returned picture
    And the picture stays in place when someone speaks again

  Scenario: A returned picture fits the room on a phone
    Given I am ROOT on a phone
    When I open the App
    And I ask an Agent for a picture in the room
    Then its picture arrives inside its reply
    And the picture and composer fit the phone

  # The phone app's, not the page's: walked nowhere yet.
  @phone
  Scenario: The human user is told on the phone
    Given an Agent put something back into the room
    Then a push notification happens for the human user
    And I open the result in the phone app
