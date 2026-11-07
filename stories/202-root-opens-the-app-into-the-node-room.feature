Feature: ROOT opens the App into the Node Room, with piranha behind it

  "do you see piranha, how much work would it be to have that as the Room backdrop. and having our things, text be drawn on top, and still make it legible"
  "so 3 Agents is 3 fish."
  "piranha is in ramen"
  "and having the Node Room be the default think i enter into when i open the App on my Phone, with that backdrop"
  "making it a thing in its own right seems interesting, because you can then place it as a live visual on the canvas itself, and it opens the door for reactive melding (in the future)"

  Background:
    Given I am ROOT

  Scenario: piranha is an element of its own
    Given piranha is published on the node as an element
    When I place piranha on the canvas
    Then it swims there, live

  Scenario: The Node Room has piranha behind it
    Given piranha is published on the node as an element
    And I am in the Node Room Element
    Then piranha swims behind the board
    And what is said in the room is drawn on top, legible
    And each Agent in the room is a fish

  Scenario: ROOT opens the App on the phone
    Given I am ROOT on a phone
    When I open the App
    Then I am in the Node Room Element, with that backdrop
