import React from 'react';
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  useColorMode,
} from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiMessageCircle,
  FiSettings,
  FiFileText,
} from 'react-icons/fi';

import Sidebar from './Sidebar';
import Header from './Header';

const mobileLinks = [
  { name: 'Home', path: '/', icon: FiHome },
  { name: 'Chats', path: '/conversations', icon: FiMessageCircle },
  { name: 'Templates', path: '/analysis', icon: FiFileText },
  { name: 'Agent', path: '/agent-config', icon: FiSettings },
];

const Layout = ({ children }) => {
  const { colorMode } = useColorMode();
  const location = useLocation();

  return (
    <Flex direction="row" minH="100vh" w="100%">
      <Sidebar />

      <Box
        flex="1"
        minW={0}
        bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
        minH="100vh"
      >
        <Header />

        <Box
          as="main"
          p={{ base: 3, md: 4 }}
          pb={{ base: '88px', md: 4 }}
          ml={{ base: 0, md: '250px' }}
          minW={0}
        >
          {children}
        </Box>
      </Box>

      <HStack
        display={{ base: 'flex', md: 'none' }}
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={100}
        bg={colorMode === 'dark' ? 'gray.900' : 'white'}
        borderTop="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        justify="space-around"
        spacing={0}
        px={1}
        py={2}
        paddingBottom="max(8px, env(safe-area-inset-bottom))"
      >
        {mobileLinks.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== '/' &&
              location.pathname.startsWith(item.path));

          return (
            <Flex
              key={item.path}
              as={Link}
              to={item.path}
              flex="1"
              minW={0}
              direction="column"
              align="center"
              justify="center"
              gap={1}
              py={1}
              color={active ? 'purple.600' : 'gray.500'}
              aria-current={active ? 'page' : undefined}
            >
              <Icon as={item.icon} boxSize={5} />
              <Text fontSize="xs" fontWeight={active ? '700' : '500'}>
                {item.name}
              </Text>
            </Flex>
          );
        })}
      </HStack>
    </Flex>
  );
};

export default Layout;