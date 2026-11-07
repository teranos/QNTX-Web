Feature: ROOT chooses the ground

  "the visual backdrop needs to always be there regardless of being in a Room or not, but not as glitchy, and other elements can replace the backdrop kind of idea."
  "i want backdrop glovbal"
  "i want element to be able to override global backdrop"
  "via /g/ as a full fledged Element like we talked about before"
  "Goal set: global backdrop, element backdrop overwrite, via /g/, default global backdrop can be boring is ok. option to choose between backdrops by clicking on profile pic."

  Scenario: the ground is there when ROOT arrives
    Given I am ROOT on the mock
    Then the ground under everything is pond, published at /g/

  Scenario: ROOT chooses plain from the picture, and the choice is kept
    Given I am ROOT on the mock
    When I click my picture
    Then the Backdrop element opens, naming pond and plain
    When I choose plain
    Then the ground is plain
    When I come back
    Then the ground is still plain
    When I click my picture
    And I choose pond
    Then the ground under everything is pond, published at /g/
