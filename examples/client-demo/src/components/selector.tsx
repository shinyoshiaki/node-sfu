import {
  Badge,
  Box,
  Button,
  Text,
  Radio,
  RadioGroup,
  Stack,
  Center,
} from "@chakra-ui/react";
import { FC, useState } from "react";

export const Selector: FC<{
  button: string;
  onClick: (res: boolean) => void;
}> = ({ button, onClick }) => {
  const [value, setValue] = useState("false");

  return (
    <Stack direction="row" borderWidth="1px" padding={1}>
      <Center>
        <RadioGroup onChange={setValue as any} value={value}>
          <Stack direction="row">
            <Text>simulcast</Text>
            <Radio value="true">enable</Radio>
            <Radio value="false">disable</Radio>
          </Stack>
        </RadioGroup>
      </Center>
      <Button onClick={() => onClick(value === "true" ? true : false)}>
        {button}
      </Button>
    </Stack>
  );
};
